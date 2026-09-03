import UserModel from "../models/user.models.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import redis from "../config/redis.db.js";

async function registerController(req, res) {
  try {
    const { firstname, lastname, username, email, password, confirmPassword } =
      req.body;

    if (
      !firstname ||
      !lastname ||
      !username ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const isUserExist = await UserModel.findOne({
      $or: [{ username }, { email }],
    });

    if (isUserExist) {
      return res
        .status(400)
        .json({ message: "Username or email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await UserModel.create({
      firstname,
      lastname,
      username,
      email,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "Registration successful.",
      user: {
        id: newUser._id,
        firstName: newUser.firstname,
        lastName: newUser.lastname,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Register Error Details:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on our end. Please try again later.",
    });
  }
}

async function loginController(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Please Create Account" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    // AccessToken -->>
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_KEY,
      { expiresIn: "15m" },
    );

    // RefreshToken -->>
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_KEY,
      { expiresIn: "7d" },
    );

    const sessionLoginRefreshToken = {
      refreshToken,
      createdAt: new Date().toISOString(),
      device: req.headers["user-agent"] || "Unknown",
      ipAddress: req.ip || req.connection.remoteAddress || "Unknown",
    };

    await redis.set(
      `auth-session:${user._id}`,
      JSON.stringify(sessionLoginRefreshToken),
      "EX",
      7 * 24 * 60 * 60,
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, // JS can't access it
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict", // prevents CSRF attack
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days expiry
    });

    return res.status(201).json({
      message: "Login successful.",
      user: {
        id: user._id,
        firstName: user.firstname,
        lastName: user.lastname,
        username: user.username,
        email: user.email,
      },
      accessToken,
    });
  } catch (error) {
    console.error("Login Error Details:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on our end. Please try again later.",
    });
  }
}

async function refreshToken(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "No token provided!" });
    }

    const decodeRefreshToken = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_KEY,
    );

    const authSession = await redis.get(
      `auth-session:${decodeRefreshToken.userId}`,
    );

    if (!authSession) {
      return res
        .status(401)
        .json({ message: "Session expired. Please login again." });
    }

    const sessionData = JSON.parse(authSession);
    if (sessionData.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token." });
    }

    const newAccessToken = jwt.sign(
      { userId: decodeRefreshToken.userId },
      process.env.ACCESS_TOKEN_KEY,
      { expiresIn: "15m" },
    );

    return res.status(200).json({
      message: "Token refreshed successfully.",
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Refresh-Token Error Details:", error.message);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on our end. Please try again later.",
    });
  }
}

async function getMeProfile(req, res) {
  try {
    const userId = req.user;

    // Start Timer 1
    console.time("⏱️ Total Redis Time");
    const userGetRedis = await redis.get(`userRegisterProfile:${userId}`);
    console.timeEnd("⏱️ Total Redis Time");

    if (userGetRedis) {
      return res.status(200).json({
        success: true,
        source: "cache",
        data: JSON.parse(userGetRedis),
      });
    }

    // Start Timer 2
    console.log("🐢 Cache Miss - Fetching from MongoDB");
    console.time("⏱️ Total MongoDB Query Time");
    const user = await UserModel.findById(req.user).select("-password");
    console.timeEnd("⏱️ Total MongoDB Query Time");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Start Timer 3
    console.time("⏱️ Redis Save Time");
    await redis.set(
      `userRegisterProfile:${userId}`,
      JSON.stringify(user),
      "EX",
      3600,
    );
    console.timeEnd("⏱️ Redis Save Time");

    return res.status(200).json({
      message: "Registration Details Featched Successfully!!",
      data: user,
    });
  } catch (error) {
    console.error("Get-me Error Details:", error.message);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on our end. Please try again later.",
    });
  }
}

async function logoutController(req, res) {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(200).json({ message: "Already logged out" });
    }

    try {
      const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_KEY);
      await redis.del(`auth-session:${decoded.userId}`);
      await redis.del(`userRegisterProfile:${decoded.userId}`);
      await redis.del(`family-members:${decoded.userId}`);


      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: false, // set true in production with https
        sameSite: "strict",
      });

      return res.status(200).json({ message: "Logout successful" });
    } catch (error) {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      return res.status(200).json({ message: "Session already invalid" });
    }
  } catch (error) {
    console.error("Logout Error Details:", error.message);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on our end. Please try again later.",
    });
  }
}

export {
  registerController,
  loginController,
  refreshToken,
  getMeProfile,
  logoutController,
};
