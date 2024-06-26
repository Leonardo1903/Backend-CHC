import apiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";
import JWT from "jsonwebtoken";
import User from "../models/User";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  // JWT verification logic:-
  // Get access token from cookies
  // Check if access token exists
  // Verify access token
  // Get user details from access token
  // Attach user details to request object
  // Call next

  try {
    const accessToken =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!accessToken) {
      throw new apiError(401, "Unauthorized request");
    }

    const decodedToken = JWT.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new apiError(404, "User does not exist");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new apiError(401, error?.message || "invalid token");
  }
});
