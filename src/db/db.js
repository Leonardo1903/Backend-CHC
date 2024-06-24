// Approach 2: Connect to the database in a separate file
import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

export const connectDB = async () => {
  try {
    const Instance = await mongoose.connect(
      `${process.env.MONGO_URI}/${DB_NAME}`
    );
    console.log(`MongoDB connected DB Host: ${Instance.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection failed: ", error);
    process.exit(1);
  }
};
