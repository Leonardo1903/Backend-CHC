import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import mongoose from "mongoose";

export const getChannelStats = asyncHandler(async (req, res) => {
  // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
  // get user from req.user?._id
  const user = req.user?._id;
  if (!user) {
    throw new apiError(404, "User not found");
  }

  // get channel stats
  const channelStats = await User.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(user),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "TotalVideos",
        pipeline: [
          {
            $lookup: {
              from: "likes",
              localField: "_id",
              foreignField: "video",
              as: "VideoLikes",
            },
          },
          {
            $lookup: {
              from: "comments",
              localField: "_id",
              foreignField: "video",
              as: "VideoComments",
            },
          },
          {
            $addFields: {
              VideoLikes: { $size: "$VideoLikes" },
              VideoComments: { $size: "$VideoComments" },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "Subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "SubscribedTo",
      },
    },
    {
      $lookup: {
        from: "tweets",
        localField: "_id",
        foreignField: "tweet",
        as: "tweets",
        pipeline: [
          {
            $lookup: {
              from: "likes",
              localField: "_id",
              foreignField: "tweet",
              as: "TweetLikes",
            },
          },
          {
            $addFields: {
              TweetLikes: { $size: "$TweetLikes" },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "owner",
        as: "comments",
        pipeline: [
          {
            $lookup: {
              from: "likes",
              localField: "_id",
              foreignField: "comment",
              as: "CommentLikes",
            },
          },
          {
            $addFields: {
              CommentLikes: { $size: "$CommentLikes" },
            },
          },
        ],
      },
    },
    {
      $project: {
        username: 1,
        email: 1,
        fullname: 1,
        avatar: 1,
        TotalComments: { $sum: "$TotalVideos.VideoComments" },
        TotalViews: { $sum: "$TotalVideos.views" },
        TotalVideos: { $size: "$TotalVideos" },
        Subscribers: { $size: "$Subscribers" },
        SubscribedTo: { $size: "$SubscribedTo" },
        TotalTweets: { $size: "$tweets" },
        TotalLikes: {
          videoLikes: { $sum: "$TotalVideos.VideoLikes" },
          tweetLikes: { $sum: "$tweets.TweetLikes" },
          commentLikes: { $sum: "$comments.CommentLikes" },
          total: {
            $add: [
              "$TotalVideos.VideoLikes",
              "$tweets.TweetLikes",
              "$comments.CommentLikes",
            ],
          },
        },
      },
    },
  ]);

  if (!channelStats) {
    throw new apiError(404, "Channel not found");
  }

  // return response
  return res
    .status(200)
    .json(new apiResponse(200, channelStats[0], "Channel Stats"));
});

export const getChannelVideos = asyncHandler(async (req, res) => {
  // TODO: Get all the videos uploaded by the channel

  const user = req.user?._id;
  if (!user) {
    throw new apiError(404, "User not found");
  }

  const videos = await Video.aggregate([
    {
      $match: {
        owner: mongoose.Types.ObjectId(user),
      },
    },
    {
      $project: {
        title: 1,
        description: 1,
        thumbnail: "$thumbnail.url",
        videoFile: "$videoFile.url",
        views: 1,
        duration: 1,
        isPublished: 1,
      },
    },
  ]);

  if (!videos) {
    throw new apiError(404, "Videos not found");
  }

  return res.status(200).json(new ApiResponse(200, videos, "Channel Videos"));
});
