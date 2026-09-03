import redis from "../config/redis.db.js";
import FamilyMember from "../models/familymember.models.js";

async function registerFamilyMember(req, res) {
  try {
    const { firstName, lastName, relation, dateOfBirth, gender } = req.body;

    if (!firstName || !lastName || !relation || !dateOfBirth || !gender) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const allowedGenders = ["male", "female", "other"];
    if (!allowedGenders.includes(gender.toLowerCase())) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Gender must be one of: ${allowedGenders.join(", ")}`,
        });
    }

    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime()) || dob > new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid dateOfBirth" });
    }

    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, user not found" });
    }

    // req.user is usually { _id, id } from auth middleware, not a string
    const familyHead = req.user._id || req.user.id || req.user;
    const cacheKey = `family-members:${familyHead}`; // <-- DEFINE IT

    const newFamilyMember = await FamilyMember.create({
      familyHead,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      relation: relation.toLowerCase().trim(),
      dateOfBirth: dob,
      gender: gender.toLowerCase().trim(),
    });

    // Invalidate AFTER successful create
    await redis.del(cacheKey);
    // console.log(`Cache invalidated: ${cacheKey}`);

    return res.status(201).json({
      success: true,
      message: "Family Member Registered",
      data: newFamilyMember,
    });
  } catch (error) {
    console.error("Error in registerFamilyMember:", error.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Internal Server Error",
        error: error.message,
      });
  }
}

async function getFamilyMember(req, res) {
  try {
    const familyHead = req.user._id || req.user.id || req.user;
    const cacheKey = `family-members:${familyHead}`;

    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      // console.log("Cache Hit");
      return res
        .status(200)
        .json({
          success: true,
          source: "cache",
          members: JSON.parse(cachedData),
        });
    }

    // console.log("Cache Miss");
    const getData = await FamilyMember.find({ familyHead }).lean();
    await redis.set(cacheKey, JSON.stringify(getData), "EX", 3600);

    return res
      .status(200)
      .json({ success: true, source: "database", members: getData });
  } catch (error) {
    console.error("Error in GetFamilyMember:", error.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Internal Server Error",
        error: error.message,
      });
  }
}

async function updateFamilyMember(req, res) {
  try {
    const { id } = req.params;
    const { firstName, lastName, relation, dateOfBirth, gender } = req.body;

    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const familyHead = req.user._id || req.user.id || req.user;
    const cacheKey = `family-members:${familyHead}`;

    const updatedFamilyMember = await FamilyMember.findByIdAndUpdate(
      id,
      {
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        relation: relation?.toLowerCase().trim(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender: gender?.toLowerCase().trim(),
      },
      { new: true }
    );

    if (!updatedFamilyMember) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    // update redis - just delete cache like you do in register
    await redis.del(cacheKey);
    // console.log(`Cache invalidated: ${cacheKey}`);

    return res.status(200).json({
      success: true,
      message: "Family Member Updated",
      data: updatedFamilyMember,
    });

  } catch (error) {
    console.error("Error in updateFamilyMember:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

async function deleteFamilyMember(req, res) {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const familyHead = req.user._id || req.user.id || req.user;
    const cacheKey = `family-members:${familyHead}`;

    const deletedMember = await FamilyMember.findByIdAndDelete(id);

    if (!deletedMember) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    // delete cache same as register/update
    await redis.del(cacheKey);
    // console.log(`Cache invalidated: ${cacheKey}`);

    return res.status(200).json({
      success: true,
      message: "Family Member Deleted",
      data: deletedMember,
    });

  } catch (error) {
    console.error("Error in deleteFamilyMember:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

export { registerFamilyMember, getFamilyMember, updateFamilyMember, deleteFamilyMember };
