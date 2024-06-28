import mongoose from "mongoose";
import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import apiResponse from "../utils/apiResponse.js";
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
    { $unset: { refreshToken: 1 } },
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
    req.cookies.refreshToken || req.header.refreshToken;

  if (!incomingRefreshToken) {
    throw new apiError(401, "Unauthorized Access");
  }

  try {
    const decodedToken = JWT.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new apiError(401, "Invalid Refresh Token");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new apiError(401, "Refresh Token is expired or Used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new apiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Token refreshed successfully"
        )
      );
  } catch (error) {
    throw new apiError(400, error?.message || "Invalid Access");
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

export const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new apiError(400, "Username is missing");
  }

  // Pipeline to get user channel subscribers and subscriptions
  const channel = await User.aggregate([
    {
      $match: { username: username?.toLowerCase() },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscriptions",
      },
    },
    {
      $addFields: {
        subscribersCount: { $size: "$subscribers" },
        subscriptionsCount: { $size: "$subscriptions" },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        subscriptionsCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new apiError(404, "Channel not found");
  }
  return res
    .status(200)
    .json(new apiResponse(200, channel[0], "Channel fetched successfully"));
});

export const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(req.user._id) },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory.video",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: { $arrayElemAt: ["$owner", 0] },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(new apiResponse(200, user[0].watchHistory, "Watch history fetched"));
});
