import asyncHandler from "../utils/asyncHandler.js";
import mongoose, { isValidObjectId } from "mongoose";
import apiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";
import { Subscription } from "../models/subscription.models.js";

export const toggleSubscription = asyncHandler(async (req, res) => {
  // TODO: toggle subscription
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new apiError(401, "Invalid channel id");
  }

  const subscriberId = req.user?._id;
  if (!subscriberId) {
    throw new apiError(401, "Invalid User");
  }

  const isSubscribed = await Subscription.findOne({
    subscriber: subscriberId,
    channel: channelId,
  });
  let response;
  try {
    response = isSubscribed
      ? await Subscription.deleteOne({
          subscriber: subscriberId,
          channel: channelId,
        })
      : await Subscription.create({
          subscriber: subscriberId,
          channel: channelId,
        });
  } catch (error) {
    console.log("toggleSubscriptionError :: ", error);
    throw new apiError(500, error?.message || "Internal server Error");
  }

  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        response,
        isSubscribed === null
          ? "subscribed Succesfully"
          : "unsubscribed Sucessfully"
      )
    );
});

// controller to return subscriber list of a channel
export const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  if (!isValidObjectId(subscriberId)) {
    throw new apiError(401, "invalid channel Id");
  }

  const channelSubscriber = await Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
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
        subscriber: {
          $first: "$subscriber",
        },
      },
    },
  ]);

  const subscribersList = channelSubscriber.map((item) => item.subscriber);
  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        subscribersList,
        "subscriberlist fetched successfully"
      )
    );
});

// controller to return channel list to which user has subscribed
export const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new apiError(401, "Invalid channel");
  }

  const channelSubscribedTo = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "subscribedto",
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
      $project: {
        subscribedto: {
          $first: "$subscribedto",
        },
      },
    },
  ]);

  const subscribedToList = channelSubscribedTo.map((item) => item.subscribedto);
  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        subscribedToList,
        "subscribedto list fetched succesfully"
      )
    );
});
