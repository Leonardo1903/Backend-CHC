import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.models.js";
import { Video } from "../models/video.models.js";
import { Comment } from "../models/comment.models.js";
import { Tweet } from "../models/tweet.models.js";

export const toggleVideoLike = asyncHandler(async (req, res) => {
  //TODO: toggle like on video
  const { videoId } = req.params;

  // check if videoId is valid ObjectId
  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid Object Id");
  }

  // check if video exists
  const video = await Video.findById(videoId);
  if (!video) {
    throw new apiError(404, "Video not Found");
  }

  // check if video is already liked by user
  const likedVideo = await Like.findOne({ video: videoId }, { _id: 1 });

  // toggle like
  const isLiked = likedVideo
    ? await Like.deleteOne(likedVideo)
    : await Like.create({
        video: videoId,
        likedBy: req.user?._id,
      });

  // return response
  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        isLiked,
        likedVideo ? "video like removed" : "video liked"
      )
    );
});

export const toggleCommentLike = asyncHandler(async (req, res) => {
  //TODO: toggle like on comment
  const { commentId } = req.params;

  // check if commentId is valid ObjectId
  if (!isValidObjectId(commentId)) {
    throw new apiError(400, "Invalid Object Id");
  }

  // check if comment exists
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new apiError(404, "Comment not Found");
  }

  // check if comment is already liked by user
  const likedComment = await Like.findOne({ comment: commentId }, { _id: 1 });

  // toggle like
  const isLiked = likedComment
    ? await Like.deleteOne(likedComment)
    : await Like.create({
        comment: commentId,
        likedBy: req.user?._id,
      });

  // return response
  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        isLiked,
        likedComment ? "comment like removed" : "Comment liked"
      )
    );
});

export const toggleTweetLike = asyncHandler(async (req, res) => {
  //TODO: toggle like on tweet
  const { tweetId } = req.params;

  // check if tweetId is valid ObjectId
  if (!isValidObjectId(tweetId)) {
    throw new apiError(400, "Invalid Object Id");
  }

  // check if tweet exists
  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new apiError(404, "Tweet not Found");
  }

  // check if tweet is already liked by user
  const likedTweet = await Like.findOne({ tweet: tweetId }, { _id: 1 });

  // toggle like
  const isLiked = likedTweet
    ? await Like.deleteOne(likedTweet)
    : await Like.create({
        tweet: tweetId,
        likedBy: req.user?._id,
      });

  // return response
  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        isLiked,
        likedTweet ? "tweet like removed" : "Tweet liked"
      )
    );
});

export const getLikedVideos = asyncHandler(async (req, res) => {
  //TODO: get all liked videos

  const likedVideos = await Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "likedVideo",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "ownerDetails",
            },
          },
          {
            $unwind: "$ownerDetails",
          },
        ],
      },
    },
    {
      $unwind: "$likedVideo",
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        _id: 0,
        likedVideo: {
          _id: 1,
          "videoFile.url": 1,
          "thumbnail.url": 1,
          owner: 1,
          title: 1,
          description: 1,
          views: 1,
          duration: 1,
          createdAt: 1,
          isPublished: 1,
          ownerDetails: {
            username: 1,
            fullName: 1,
            "avatar.url": 1,
          },
        },
      },
    },
  ]);

  if (!likedVideos) {
    throw new apiError(404, "No liked videos found");
  }
  return res
    .status(200)
    .json(new apiResponse(200, likedVideos, "Liked Videos"));
});
