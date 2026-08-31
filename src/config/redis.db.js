// utils/redis.js
import Redis from "ioredis";

const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
  // password nahi hai locally to ye blank rahega
});

redis.on("connect", () => {
  console.log("✅ Redis Connected - Ready to use");
});

redis.on("error", (err) => {
  console.error("❌ Redis Error:", err);
});

export default redis;