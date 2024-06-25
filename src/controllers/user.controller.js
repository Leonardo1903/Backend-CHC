import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import { User } from "../models/user.models.js";
import upload from "../utils/cloudinary.js";
import apiResponse from "../utils/apiResonse.js";

export const registerUser = asyncHandler(async (req, res) => {
  // User registration logic:-
  // Get user details from frontend
  // validate user details - not empty, valid email, password length
  // Check if user exists: email, username
  // Check for images, Check for avatar
  // Upload them to cloudinary, check for avatar
  // Create user object - create entry in database
  // Remove password and refresh token from response
  // Check for user creation
  // Send response

  const { name, email, username, password } = req.body;
  console.log(name);

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new apiError(400, "All fields are required");
  }

  const ExistingUser = User.findOne({
    $or: [{ email }, { username }],
  });

  if (ExistingUser) {
    throw new apiError(409, "User already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImages[0]?.path;

  if (!avatarLocalPath) {
    throw new apiError(400, "Avatar is required");
  }

  // Upload images to cloudinary
  const avatar = await upload(avatarLocalPath);
  const coverImage = await upload(coverImageLocalPath);

  if (!avatar) {
    throw new apiError(400, "Error uploading avatar");
  }

  const user = await User.create({
    fullName,
    email,
    username: username.toLowerCase(),
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  User.findById(user._id).select("-password -refreshToken");

  if (!user) {
    throw new apiError(500, "Error creating user");
  }

  return res
    .status(201)
    .json(new apiResponse(200, user, "User created successfully"));
});
