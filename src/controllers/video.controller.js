import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { Like } from "../models/like.models.js";
import { Comment } from "../models/comment.models.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";

export const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 5,
    query = "",
    sortBy,
    sortType,
    userId,
  } = req.query;
  //TODO: get all videos based on query, sort, pagination

  // match the qury condition for both title and description
  const matchCondition = {
    $or: [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ],
  };

  //  sets owner property of matchCondition to userId
  if (userId) {
    (matchCondition.owner = new mongoose.Types.ObjectId(userId)),
      (matchCondition.isPublished = true);
  }

  // video.aggregate pipeline for matchingCondition and looking up in users collection
  let videoAggregate;
  try {
    // dont use await b/c : - Using await with Video.aggregate([...]) would execute the aggregation pipeline immediately, preventing aggregatePaginate from modifying the pipeline for pagination. By not using await, you pass the unexecuted aggregation object to aggregatePaginate, allowing it to append additional stages and handle pagination correctly.
    videoAggregate = Video.aggregate([
      {
        $match: matchCondition,
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
  } catch (err) {
    console.error("Error in aggregation:", err);
    throw new apiError(
      500,
      err.message || "Internal server error in video aggregate"
    );
  }

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

  const video = await Video.create({
    title,
    description,
    duration: videoFile.duration,
    videoFile: {
      url: videoFile.url,
      public_id: videoFile.public_id,
    },
    thumbnail: {
      url: thumbnail.url,
      public_id: thumbnail.public_id,
    },
    owner: req.user?._id,
    isPublished: false,
  });

  const videoUploaded = await Video.findById(video._id);

  if (!videoUploaded) {
    throw new apiError(500, "videoUpload failed please try again !!!");
  }

  return res
    .status(200)
    .json(new apiResponse(200, video, "Video uploaded successfully"));
});

export const getVideoById = asyncHandler(async (req, res) => {
  //TODO: get video by id
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid video id");
  }
  if (!isValidObjectId(req.user?._id)) {
    throw new apiError(400, "Invalid userId");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
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
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscribersCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: {
                    $in: [req.user?._id, "$subscribers.subscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              "avatar.url": 1,
              subscribersCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        "videoFile.url": 1,
        title: 1,
        description: 1,
        views: 1,
        createdAt: 1,
        duration: 1,
        comments: 1,
        owner: 1,
        likesCount: 1,
        isLiked: 1,
      },
    },
  ]);

  if (!video) {
    throw new apiError(500, "failed to fetch video");
  }

  // increment views if video fetched successfully
  await Video.findByIdAndUpdate(videoId, {
    $inc: {
      views: 1,
    },
  });

  // add this video to user watch history
  await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: {
      watchHistory: videoId,
    },
  });

  return res
    .status(200)
    .json(new apiResponse(200, video[0], "video details fetched successfully"));
});

export const updateVideo = asyncHandler(async (req, res) => {
  //TODO: update video details like title, description, thumbnail
  const { title, description } = req.body;
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "Video not Found");
  }

  if (!(title && description)) {
    throw new apiError(400, "Title and Description are required");
  }

  //   find old video details and retun only thumbnail object
  const video = await Video.findById(videoId);

  if (!video) {
    throw new apiError(404, "No video found");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new apiError(
      400,
      "You can't edit this video as you are not the owner"
    );
  }

  const thumbnailToDelete = video.thumbnail.public_id;

  const thumbnailLocalPath = req.file?.path;

  if (!thumbnailLocalPath) {
    throw new apiError(400, "thumbnail is required");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!thumbnail) {
    throw new apiError(400, "thumbnail not found");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: {
          public_id: thumbnail.public_id,
          url: thumbnail.url,
        },
      },
    },
    { new: true }
  );

  if (!updatedVideo) {
    throw new apiError(500, "Failed to update video please try again");
  }

  if (updatedVideo) {
    await deleteFromCloudinary(thumbnailToDelete);
  }

  return res
    .status(200)
    .json(new apiResponse(200, updatedVideo, "Video updated successfully"));
});

export const deleteVideo = asyncHandler(async (req, res) => {
  //TODO: delete video
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid video id");
  }

  // fetch video details
  const video = await Video.findById(videoId);

  if (!video) {
    throw new apiError(404, "Video not found");
  }

  // Validate owner of video
  if (video.owner.toString() !== req.user._id.toString()) {
    throw new apiError(401, "Unauthorized request");
  }

  // delete video & thumbnail from cloudinary
  const videoDeleted = await Video.findByIdAndDelete(video?._id);

  if (!videoDeleted) {
    throw new apiError(400, "Failed to delete the video please try again");
  }

  await deleteFromCloudinary(video.thumbnail.public_id);
  await deleteFromCloudinary(video.videoFile.public_id, "video");

  // delete video likes
  await Like.deleteMany({
    video: videoId,
  });

  // delete video comments
  await Comment.deleteMany({
    video: videoId,
  });

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
