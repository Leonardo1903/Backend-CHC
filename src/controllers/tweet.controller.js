import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.models.js";
import { User } from "../models/user.models.js";

export const createTweet = asyncHandler(async (req, res) => {
  //TODO: create tweet
  // get tweet content from req.body
  const { content } = req.body;

  // check if content is provided
  if (!content || content.trim() === "") {
    throw new apiError(400, "tweet content is required");
  }

  // create tweet
  const tweet = await Tweet.create({
    content,
    owner: req.user?._id,
  });
  // check if tweet is created
  if (!tweet) {
    throw new apiError(500, "Something Went Wrong While creating tweet");
  }

  // return response
  return res
    .status(200)
    .json(new apiResponse(200, tweet, "Tweet added Successfully"));
});

export const getUserTweets = asyncHandler(async (req, res) => {
  // TODO: get user tweets

  // get user id from req.params
  const { userId } = req.params;

  // get page and limit from req.query
  const { page = 1, limit = 10 } = req.query;

  // check if userId is valid objectId
  if (!isValidObjectId(userId)) {
    throw new apiError(404, "Invalid User Id");
  }

  // Create a tweets Aggregation pipeline
  const tweets = await Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              username: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweet",
        as: "likeDetails",
        pipeline: [
          {
            $project: {
              likedBy: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likeDetails",
        },
        ownerDetails: {
          $first: "$ownerDetails",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likeDetails.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        content: 1,
        ownerDetails: 1,
        likesCount: 1,
        createdAt: 1,
        isLiked: 1,
      },
    },
  ]);

  // return response
  return res
    .status(200)
    .json(new apiResponse(200, tweets, "Tweets Fetched Sucessfully"));
});

export const updateTweet = asyncHandler(async (req, res) => {
  //TODO: update tweet

  // get tweetId from req.params
  const { tweetId } = req.params;
  // get tweet content from req.body
  const { content } = req.body;

  // if tweetId is valid objectId
  if (!isValidObjectId(tweetId)) {
    throw new apiError(404, "Invalid TweetId");
  }

  // check if content is provided and is not empty
  if (!content) {
    throw new apiError(400, "Tweet Content is Required");
  }

  // check if tweet exists in collection
  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new apiError(404, "Tweet not found");
  }

  // validate if the user is owner of this tweet
  if (tweet.owner.toString() !== req.user?._id.toString()) {
    throw new apiError(403, "You are not authorized To perform this action");
  }

  // find and update tweet
  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    { content },
    { new: true }
  );
  if (!updateTweet) {
    throw new apiError(500, "some internal error occured while updating Tweet");
  }

  // return response
  return res
    .status(200)
    .json(new apiResponse(200, updatedTweet, "Tweet Updated Successfully"));
});

export const deleteTweet = asyncHandler(async (req, res) => {
  //TODO: delete tweet

  // get tweetId from req.params
  const { tweetId } = req.params;

  // if tweetId is valid objectId
  if (!isValidObjectId(tweetId)) {
    throw new apiError(404, "Invalid TweetId");
  }

  // check if tweet exists in collection
  const tweet = await Tweet.findById(tweetId, { owner: 1 });
  if (!tweet) {
    throw new apiError(404, "Tweet not found");
  }

  // validate if the user is owner of this tweet
  if (tweet.owner.toString() !== req.user?._id.toString()) {
    throw new apiError(403, "You are not authorized To perform this action");
  }

  // find and delete tweet
  const deleteTweet = await Tweet.findByIdAndDelete(tweetId);
  if (!deleteTweet) {
    throw new apiError(500, "some internal error occured while Deleting Tweet");
  }

  // return response
  return res
    .status(200)
    .json(new apiResponse(200, [], "Tweet Deleted Successfully"));
});
