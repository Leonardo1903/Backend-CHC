import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
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

  const { fullName, email, username, password } = req.body;

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new apiError(400, "All fields are required");
  }

  const ExistingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (ExistingUser) {
    throw new apiError(409, "User already exists");
  }
  // console.log(req.files);

  const avatarLocalPath = req.files.avatar[0].path;
  const coverImageLocalPath = req.files.coverImage
    ? req.files.coverImage[0].path
    : "";

  // Upload images to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new apiError(400, "Error uploading avatar");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage.url,
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new apiError(500, "Error creating user");
  }

  return res
    .status(201)
    .json(new apiResponse(201, "User created successfully", createdUser));
});
