import mongoose from "mongoose";

const familyMemberSchema = new mongoose.Schema(
  {
    familyHead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    relation: {
      type: String,
      required: true,
      trim: true,
    },

    dateOfBirth: {
      type: Date,
      required: true,
    },

    gender: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const FamilyMember = mongoose.model("familymembers", familyMemberSchema);

export default FamilyMember;