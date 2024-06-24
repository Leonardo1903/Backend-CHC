import dotenv from "dotenv";
// require("dotenv").config({path: './env'});
import app from "./app.js";
import { connectDB } from "./db/db.js";

dotenv.config({ path: "./env" });

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running on port ${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection Failed ", error);
  });

/*
Approach 1: Connect to the database and start the server in index.js

const app = express();
(async () => {
  try {
    await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
    app.on("error", () => {
      console.log("DB connection failed");
      throw error;
    });

    app.listen(3000, () => {
      console.log(`Server is running on port ${process.env.PORT}`);
    }
  } catch (error) {
    console.error("Error: ", error);
  }
})();
*/
