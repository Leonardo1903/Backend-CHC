import mongoose from "mongoose";
import asyncHandler from "../utils/asyncHandler.js";
import { Comment } from "../models/comment.models.js";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { Like } from "../models/like.models.js";
import apiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";

export const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video

  // get videoId from params and check if it is valid
  const { videoId } = req.params;

  // get page and limit from query
  const { page = 1, limit = 10 } = req.query;

  // find video by id and validate its existence
  const video = await Video.findById(videoId);
  if (!video) {
    throw new apiError(404, "Video not found");
  }

  // find all comments for the video and populate owner field with username and avatar
  const comments = Comment.aggregate([
    {
      $match: {
        video: mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        owner: { $arrayElemAt: ["$owner", 0] },
        totalLikes: { $size: "$likes" },
        isLiked: {
          $cond: {
            if: {
              $in: [req.user._id, "$likes.user"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $sort: {
        createdAt: 1,
      },
    },
  ]);

  //option for aggregatePaginate
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  // aggregatePaginate
  Comment.aggregatePaginate(comments, options, (err, result) => {
    if (err) {
      throw new apiError(500, "Error getting comments");
    }

    // return success response
    return res
      .status(200)
      .json(
        new apiResponse(
          200,
          result,
          result.totalComments === 0
            ? "No Comments Found"
            : "Comments fetched successfully"
        )
      );
  });
});

export const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
  // get videoId from params and check if it is valid
  const { videoId } = req.params;

  // get comment text from body and check if it is not empty
  const { content } = req.body;

  if (!content) {
    throw new apiError(400, "Comment cannot be empty");
  }

  // find video by id and validate its existence
  const video = await Video.findById(videoId, { _id: 1, owner: 1 });
  if (!video) {
    throw new apiError(404, "Video not found");
  }

  // find user by id and validate its existence
  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new apiError(404, "User not found");
  }

  // create a new comment
  const newComment = await Comment.create({
    content,
    video: videoId,
    user: req.user._id,
  });

  // if comment is not created successfully throw an error
  if (!newComment) {
    throw new apiError(500, "Comment not created");
  }

  // return success response
  return res
    .status(201)
    .json(apiResponse(201, "Comment added successfully", newComment));
});

export const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
  // get commentId from params and validate object id
  const { commentId } = req.params;

  // get comment text from body and check if it is not empty
  const { content } = req.body;
  if (content.trim() === "") {
    throw new apiError(400, "Comment cannot be empty");
  }

  // find comment by id and validate its existence
  const comment = await Comment.findById(commentId, { _id: 1, owner: 1 });
  if (!comment) {
    throw new apiError(404, "Comment not found");
  }

  // check if the user is the owner of the comment
  if (comment?.owner.toString() !== req.user._id.toString()) {
    throw new apiError(403, "You are not authorized to update this comment");
  }

  // update the comment with the new content
  const updatedComment = await Comment.findByIdAndUpdate(
    comment?._id,
    {
      $set: {
        content,
      },
    },
    { new: true }
  );

  // if comment is not updated successfully throw an error
  if (!updatedComment) {
    throw new apiError(500, "Error updating comment");
  }

  // return success response
  return res
    .status(200)
    .json(apiResponse(200, "Comment updated successfully", updatedComment));
});

export const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
  // get commentId from params and validate object id
  const { commentId } = req.params;

  // find comment by id and validate its existence
  const comment = await Comment.findById(commentId, { _id: 1, owner: 1 });
  if (!comment) {
    throw new apiError(404, "Comment not found");
  }

  // check if the user is the owner of the comment
  if (comment?.owner.toString() !== req.user._id.toString()) {
    throw new apiError(403, "You are not authorized to delete this comment");
  }

  // delete the comment from database and validate its deleted successfully
  const deletedComment = await Comment.findByIdAndDelete(commentId);
  if (!deletedComment) {
    throw new apiError(500, "Error deleting comment");
  }

  // delete all likes associated with the comment
  await Like.deleteMany({
    comment: commentId,
    likedBy: req.user,
  });

  // return success response
  return res
    .status(200)
    .json(apiResponse(200, "Comment deleted successfully", deletedComment));
});
