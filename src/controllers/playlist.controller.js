import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.models.js";
import { User } from "../models/user.models.js";
import { Video } from "../models/video.models.js";

export const createPlaylist = asyncHandler(async (req, res) => {
  //TODO: create playlist
  const { name, description } = req.body;
  // check if name and description is provided
  if (!name || !description) {
    throw new apiError(400, "name and description both are required");
  }

  // create playlist
  const playlist = await Playlist.create({
    name,
    description,
    owner: req.user?._id,
  });
  // check if playlist was created
  if (!playlist) {
    throw new apiError(500, "Playlist could not be created");
  }

  // return response
  return res
    .status(200)
    .json(new apiResponse(200, playlist, "Playlist created successfully"));
});

export const getUserPlaylists = asyncHandler(async (req, res) => {
  //TODO: get user playlists
  const { userId } = req.params;

  // check if user id is valid
  if (!isValidObjectId(userId)) {
    throw new apiError(400, "Invalid user id");
  }

  const playlists = await Playlist.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
      },
    },
    {
      $addFields: {
        totalVideos: {
          $size: "$videos",
        },
        totalViews: {
          $sum: "$videos.views",
        },
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        totalVideos: 1,
        totalViews: 1,
        updatedAt: 1,
      },
    },
  ]);

  if (!playlists) {
    throw new apiError(404, "Error Fetching User Playlists");
  }

  //return response
  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        playlists,
        playlists.length === 0
          ? "No Playlist Found"
          : "User playlists retrieved successfully"
      )
    );
});

export const getPlaylistById = asyncHandler(async (req, res) => {
  //TODO: get playlist by id
  const { playlistId } = req.params;
  // check if playlistId is valid
  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, "Invalid playlist id");
  }

  // check if playlist exists
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new apiError(404, "playlist not found");
  }

  const playlistVideos = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
      },
    },
    {
      $match: {
        "videos.isPublished": true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $addFields: {
        totalVideos: {
          $size: "$videos",
        },
        totalViews: {
          $sum: "$videos.views",
        },
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        createdAt: 1,
        updatedAt: 1,
        totalVideos: 1,
        totalViews: 1,
        videos: {
          _id: 1,
          "videoFile.url": 1,
          "thumbnail.url": 1,
          title: 1,
          description: 1,
          duration: 1,
          createdAt: 1,
          views: 1,
        },
        owner: {
          username: 1,
          fullName: 1,
          "avatar.url": 1,
        },
      },
    },
  ]);

  if (!playlistVideos) {
    throw new apiError(404, "Error Fetching Playlists");
  }
  return res
    .status(200)
    .json(
      new apiResponse(200, playlistVideos[0], "Playlist fetched successfully")
    );
  // check if playlist were found
});

export const addVideoToPlaylist = asyncHandler(async (req, res) => {
  // get playlistId and videoId from request parameters
  const { playlistId, videoId } = req.params;

  // check if playlistId and videoId are valid MongoDB ObjectIds
  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid playlist id or video id");
  }

  // check if playlist exists
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }
  // check if user is authenticated
  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new apiError(404, "User not found");
  }

  // check if video exists
  const video = await Video.findById(videoId);
  if (!video) {
    throw new apiError(404, "Video not found");
  }

  // check if user is the owner of the playlist
  if (user._id.toString() !== playlist.owner.toString()) {
    throw new apiError(403, "Unauthorized access");
  }

  // check if video is already in playlist
  if (playlist.videos.includes(videoId)) {
    throw new apiError(400, "Video already in playlist");
  }

  // add video to playlist
  const videoAdd = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $push: { videos: videoId },
    },
    { new: true }
  );

  // return response
  return res
    .status(200)
    .json(
      new apiResponse(200, videoAdd, "Video added to playlist successfully")
    );
});

export const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  // TODO: remove video from playlist
  const { playlistId, videoId } = req.params;

  // check if playlistId and videoId are valid MongoDB ObjectIds
  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid playlist id or video id");
  }

  // check if playlist exists
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new apiError(404, "Playlist not found");
  }

  // check if video exists
  const video = await Video.findById(videoId);
  if (!video) {
    throw new apiError(404, "Video not found");
  }

  // check if user is authorized to remove video from playlist
  if (
    (playlist.owner?.toString() && video.owner.toString()) !==
    req.user?._id.toString()
  ) {
    throw new apiError(404, "only owner can remove video from thier playlist");
  }

  // check if video is in playlist
  if (!playlist.videos.includes(videoId)) {
    throw new apiError(400, "Video not in playlist");
  }

  // remove video from playlist
  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $pull: {
        videos: videoId,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        updatedPlaylist,
        "Removed video from playlist successfully"
      )
    );
});

export const deletePlaylist = asyncHandler(async (req, res) => {
  // TODO: delete playlist
  const { playlistId } = req.params;

  // check if playlistId is valid
  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, "Invalid playlist id");
  }

  // check if playlist exists
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new apiError(404, "Playlist not found");
  }

  // check if user is authenticated
  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new apiError(404, "User not found");
  }

  // check if user is authorized to delete playlist
  if (playlist?.owner.toString() !== user?._id.toString()) {
    throw new apiError(
      403,
      "Unauthorized access, you are not allowed to perform this action"
    );
  }

  // delete playlist
  const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);
  if (!deletedPlaylist) {
    throw new apiError(500, "Error deleting playlist");
  }

  // return response
  return res
    .status(200)
    .json(new apiResponse(200, [], "Playlist deleted successfully"));
});

export const updatePlaylist = asyncHandler(async (req, res) => {
  //TODO: update playlist
  const { playlistId } = req.params;
  const { name, description } = req.body;
  // check if playlistId is valid
  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, "Invalid playlist id");
  }

  // check if name or description are provided
  if (!name || !description) {
    throw new ApiError(400, "name and description both are required");
  }

  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, "Invalid PlaylistId");
  }

  // check if playlist exists
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new apiError(404, "playlist not found");
  }

  // check if user is authenticated
  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new apiError(404, "User not found");
  }

  // check if user is authorized to update playlist
  if (playlist?.owner.toString() !== user?._id.toString()) {
    throw new apiError(
      403,
      "Unauthorized access, you are not allowed to perform this action"
    );
  }

  // update playlist
  const updatePlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      name,
      description,
    },
    { new: true }
  );
  if (!updatePlaylist) {
    throw new apiError(500, "Error updating playlist");
  }

  // return response
  return res
    .status(200)
    .json(
      new apiResponse(200, updatePlaylist, "Playlist updated successfully")
    );
});
