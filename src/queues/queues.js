import { Queue } from "bullmq";
import redis from "../config/redis.db.js";

export const reportQueue = new Queue("medicalReportQueue", {
    connection: redis
});
