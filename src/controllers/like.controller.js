import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.models.js";
import { Video } from "../models/video.models.js";
import { Comment } from "../models/comment.models.js";
import { Tweet } from "../models/tweet.models.js";
import { User } from "../models/user.models.js";

export const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: toggle like on video
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
  const { commentId } = req.params;
  //TODO: toggle like on comment

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
  const { tweetId } = req.params;
  //TODO: toggle like on tweet

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

  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new apiError(404, "User not found");
  }

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
        as: "video",
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
                    username: 1,
                    fullname: 1,
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
            $project: {
              title: 1,
              description: 1,
              thumbnail: "$thumbnail.url",
              owner: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$video",
    },
    {
      $replaceRoot: {
        newRoot: "$video",
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
