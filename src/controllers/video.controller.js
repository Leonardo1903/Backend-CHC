import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
  deleteVideoFromCloudinary,
} from "../utils/cloudinary.js";

export const getAllVideos = asyncHandler(async (req, res) => {
  //TODO: get all videos based on query, sort, pagination
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  // match the query condition for both title and description
  const matchConditions = {
    $or: [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ],
  };

  //  sets owner property of matchCondition to userId
  if (userId) {
    (matchConditions.owner = new mongoose.Types.ObjectId(userId)),
      (matchConditions.isPublished = true);
  }

  const videos = await Video.aggregate([
    {
      $match: matchConditions,
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              email: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $sort: {
        [sortBy || "createdAt"]: sortType === "desc" ? -1 : 1,
      },
    },
  ]);

  // options for aggregatePaginate
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    customLabels: {
      totalDocs: "totalVideos",
      docs: "videos",
    },
  };

  // video.aggregatePaginate for pagination
  Video.aggregatePaginate(videoAggregate, options).then((result) => {
    try {
      res
        .status(200)
        .json(
          new apiResponse(
            200,
            result,
            result.totalVideos === 0
              ? "No video found"
              : "videos fetched successfully"
          )
        );
    } catch (error) {
      console.error("Error in aggregatePaginate:", error);
      throw new apiError(
        500,
        error.message || "Internal server error in video aggregatePaginate"
      );
    }
  });
});

export const publishAVideo = asyncHandler(async (req, res) => {
  // TODO: get video, upload to cloudinary, create video
  const { title, description } = req.body;

  const ownerId = req.user._id;
  if (!ownerId) {
    throw new apiError(401, "Unauthorized request");
  }

  if (title === "" || description === "") {
    throw new apiError(400, "Title and description are required");
  }

  const videoFileLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!videoFileLocalPath || !thumbnailLocalPath) {
    throw new apiError(400, "Video file and thumbnail are required");
  }

  // upload video to cloudinary
  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoFile || !thumbnail) {
    throw new apiError(
      500,
      "Failed to upload video and thumbnail to cloudinary"
    );
  }

  const newVideo = await Video.create({
    title,
    description,
    videoFile: { publicId: videoFile?.public_id, url: videoFile?.url },
    thumbnail: { publicId: thumbnail?.public_id, url: thumbnail?.url },
    owner: req.user?._id,
    duration: videoFile?.duration,
  });

  if (!newVideo) {
    throw new apiError(500, "Failed to publish video");
  }

  return res
    .status(201)
    .json(new apiResponse(201, newVideo, "Video published successfully", true));
});

export const getVideoById = asyncHandler(async (req, res) => {
  //TODO: get video by id
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid video id");
  }

  //   find video in video collection
  const videoFind = await Video.findById(videoId);
  if (!videoFind) {
    throw new apiError(404, "Video not found");
  }

  // find owner of the video
  const owner = await User.findById(req.user._id, { watchistory: 1 });
  if (!owner) {
    throw new apiError(404, "Owner not found");
  }

  // increment the view by one
  if (!userFind?.watchhistory.includes(videoId)) {
    await Video.findByIdAndUpdate(
      videoId,
      {
        $inc: {
          views: 1,
        },
      },
      { new: true }
    );
  }

  // add video to users watchHistory
  await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: {
      watchhistory: videoId,
    },
  });

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1,
              email: 1,
              fullname: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
        videoFile: "$videoFile.url",
        thumbnail: "$thumbnail.url",
      },
    },
  ]);

  if (!video) {
    throw new apiError(400, "video not found");
  }

  return res
    .status(200)
    .json(new apiResponse(200, video[0], "Video details fetched Succesfully"));
});

export const updateVideo = asyncHandler(async (req, res) => {
  //TODO: update video details like title, description, thumbnail
  const { videoId } = req.params;

  const { title, description } = req.body;
  const thumbnailLocalPath = req.file?.path;

  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "Video not Found");
  }

  if (!(title || description) || !thumbnailLocalPath) {
    throw new apiError(400, "fields are required");
  }

  //   find old video details and retun only thumbnail object
  const oldVideoFind = await Video.findById(videoId, { thumbnail: 1 });
  if (!oldVideoFind) {
    throw new apiError(400, "old video not found");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
  if (!thumbnail) {
    throw new apiError(
      500,
      "An error occured while uploading thumbnail on cloudinary"
    );
  }
  const video = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: {
          publicId: thumbnail?.public_id,
          url: thumbnail?.url,
        },
      },
    },
    { new: true }
  );

  const deleteOldThumbnail = await deleteFromCloudinary(
    oldVideoFind?.thumbnail?.publicId
  );
  if (!(deleteOldThumbnail.result === "ok")) {
    throw new apiError(500, "error while deleting old image");
  }

  return res
    .status(200)
    .json(new apiResponse(200, video, "Video Details updated Successfully"));
});

export const deleteVideo = asyncHandler(async (req, res) => {
  //TODO: delete video
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid video id");
  }

  // fetch video details
  const video = await Video.findById(videoId, {
    _id: 1,
    owner: 1,
    videoFile: 1,
    thumbnail: 1,
  });

  if (!video) {
    throw new apiError(404, "Video not found");
  }

  // Validate owner of video
  if (video.owner.toString() !== req.user._id.toString()) {
    throw new apiError(401, "Unauthorized request");
  }

  // delete video & thumbnail from cloudinary
  const deletedVideo = await deleteVideoFromCloudinary(
    video.videoFile.publicId
  );
  const deletedThumbnail = await deleteFromCloudinary(video.thumbnail.publicId);

  // check if video and thumbnail deleted successfully
  if (!(deletedVideo.result === "ok") || !(deletedThumbnail.result === "ok")) {
    throw new apiError(500, "An error occured while deleting video");
  }

  // delete video from videos collection and remove video from users watch history
  await Video.findByIdAndDelete(videoId);
  await User.updateMany(
    { watchhistory: videoId },
    { $pull: { watchhistory: videoId } },
    { new: true }
  );

  return res
    .status(200)
    .json(new apiResponse(200, {}, "Video deleted successfully"));
});

export const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid Video");
  }

  // fetch video details
  const video = await Video.findById(videoId, {
    _id: 1,
    isPublished: 1,
    owner: 1,
  });
  if (!video) {
    throw new apiError(404, "video not found");
  }

  // validate owner of the video
  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new apiError(401, "You are not authorized to perform this action");
  }

  // update video publish status
  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    { isPublished: !video?.isPublished },
    { new: true }
  );

  if (!updatedVideo) {
    throw new apiError(
      500,
      "An error occured while updating video publish Status"
    );
  }
  // return response
  res
    .status(200)
    .json(
      new apiResponse(
        200,
        updatedVideo,
        updatedVideo.isPublished ? "Video Published" : "Video Unpublished"
      )
    );
});
