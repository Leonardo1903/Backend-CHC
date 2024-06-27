import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import apiResponse from "../utils/apiResonse.js";
import JWT from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new apiError(500, "Error generating tokens");
  }
};

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

export const loginUser = asyncHandler(async (req, res) => {
  // User login logic:-
  // Get user details from frontend
  // validate user details - not empty, valid email, password length
  // Check if user exists: email
  // Check for password
  // Generate access and refresh token
  // Send cookies
  // Send response

  const { email, password, username } = req.body;

  if (!username || !email) {
    throw new apiError(400, "Email or username are required");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  }).select("+password");

  if (!user) {
    throw new apiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new apiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new apiResponse(200, "User logged in successfully", {
        user: loggedInUser,
        accessToken,
        refreshToken,
      })
    );
});

export const logoutUser = asyncHandler(async (req, res) => {
  // User logout logic:-
  // Clear cookies
  // Send response

  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { refreshToken: undefined } },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, "User logged out successfully"));
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  // User refresh token logic:-
  // Get refresh token from cookies
  // Check if refresh token exists
  // Verify refresh token
  // Generate new access token
  // Send response

  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new apiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = JWT.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new apiError(404, "Invalid Refresh Token");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new apiError(401, "Unauthorized request");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new apiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new apiError(401, "Unauthorized request");
  }
});

export const getUserProfile = asyncHandler(async (req, res) => {
  // User get profile logic:-
  // Get user details from frontend
  // Check if user exists: email
  // Send response
  return res
    .status(200)
    .json(new apiResponse(200, req.user, "Current user fetched Succesfully"));
});

export const changePassword = asyncHandler(async (req, res) => {
  // User change password logic:-
  // Get user details from frontend
  // validate user details - not empty, valid email, password length
  // Check if user exists: email
  // Check for old password
  // Update password
  // Send response

  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new apiError(401, "Invalid old password");
  }

  if (oldPassword === newPassword) {
    throw new apiError(400, "New password cannot be the same as old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new apiResponse(200, "Password changed successfully"));
});

export const updateUserProfile = asyncHandler(async (req, res) => {
  // User update profile logic:-
  // Get user details from frontend
  // Check if user exists: email
  // Update user object - update entry in database
  // Remove password and refresh token from response
  // Send response

  const { fullName, email, username } = req.body;

  if (!(fullName || email || username)) {
    throw new apiError(400, "please provide fullname or email");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { fullName, email, username },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new apiResponse(200, user, "Details updated Successfully"));
});

export const updateAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.files.avatar[0].path;

  if (!avatarLocalPath) {
    throw new apiError(400, "Avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new apiError(400, "Error uploading avatar");
  }

  const oldAvatar = avatarLocalPath.split("/");
  const oldAvatarId = oldAvatar[oldAvatar.length - 1].split(".")[0];
  const deleteAvatar = await deleteFromCloudinary(oldAvatarId);
  console.log(deleteAvatar);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { avatar: avatar.url },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new apiResponse(200, "Avatar updated successfully", user));
});

export const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.files.avatar[0].path;

  if (!coverImageLocalPath) {
    throw new apiError(400, "Cover Image is required");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new apiError(400, "Error uploading cover image");
  }

  const oldCoverImage = coverImageLocalPath.split("/");
  const oldCoverImageId = oldCoverImage[oldCoverImage.length - 1].split(".")[0];
  const deleteCoverImage = await deleteFromCloudinary(oldCoverImageId);
  console.log(deleteCoverImage);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { coverImage: coverImage.url },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new apiResponse(200, "Cover Image updated successfully", user));
});
