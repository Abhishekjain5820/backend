const Request = require("../model/requestModel");
const admin = require("firebase-admin");
const Test = require("../model/testModel");
const User = require("../model/userModel");
const Collector = require("../model/collectorModel");
const updateRequestStatusController = async (req, res) => {
  try {
    const { newStatus, fcmToken } = req.body;
    const { requestId } = req.params;
    // Validate request ID and new status
    if (!newStatus) {
      return res.status(400).json({
        success: false,
        message: "Missing required data",
      });
    }

    // Check if the request ID is valid
    const existingRequest = await Request.findById(requestId)
      .populate("userId")
      .populate("collectorId");
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    const collector = existingRequest.collectorId;
    const user = existingRequest.userId;
    // Update the request status
    existingRequest.status = newStatus;
    existingRequest.updatedAt = Date.now(); // Update updatedAt field

    // Save the updated request
    const updatedRequest = await existingRequest.save();

    if (newStatus == "Accepcted") {
      user.isBooked = true;
      collector.isWorking = true;
      collector.testRunning = requestId;
    }
    if (newStatus == "Test Started") {
      const message = {
        data: {
          title: "Test Started",
          body: "Your test has been started!",
        },
        token: fcmToken,
      };
      const response = await admin.messaging().send(message);
    }
    if (newStatus == "Test completed") {
      collector.isWorking = false;
      const message = {
        data: {
          title: "Test Completed",
          body: "Your test has been completed successfully!",
        },
        token: fcmToken,
      };
      const response = await admin.messaging().send(message);
    }

    return res.status(200).json({
      success: true,
      message: "Request status updated successfully",
      updatedRequest: updatedRequest,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error updating request status",
    });
  }
};
const deleteRequestController = async (req, res) => {
  try {
    const { requestId } = req.params;

    // Validate request ID
    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: "Request ID is missing",
      });
    }

    // Find and delete the request by ID
    const deletedRequest = await Request.findByIdAndDelete(requestId);

    if (!deletedRequest) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Request deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error deleting request",
    });
  }
};
const findPendingRequestController = async (req, res) => {
  try {
    const pendingRequests = await Request.find({ status: "Pending" }); // Find requests with status 'pending'
    return res.status(200).json({ success: true, pendingRequests });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch pending requests" });
  }
};
const findAccepctedRequestController = async (req, res) => {
  try {
    const accepctedRequests = await Request.find({ status: "Accepted" }); // Find requests with status 'pending'
    return res.status(200).json({ success: true, accepctedRequests });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch accepcted requests" });
  }
};
const findRejectedRequestController = async (req, res) => {
  try {
    const rejectedRequests = await Request.find({ status: "Rejected" }); // Find requests with status 'pending'
    return res.status(200).json({ success: true, rejectedRequests });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch pending requests" });
  }
};
const checkRequestStatusController = async (req, res) => {
  const { requestId } = req.params; // Assuming request ID is sent as a parameter

  try {
    const request = await Request.findById(requestId);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }

    res.json({ success: true, request: request });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error checking request status" });
  }
};
const updatePaymentMethodController = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { paymentMethod } = req.body;

    const updatedRequest = await Request.findByIdAndUpdate(
      requestId,
      { paymentMethod: paymentMethod },
      { new: true }
    );

    if (!updatedRequest) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }

    res.status(200).json({
      success: true,
      message: "Payment method updated successfully",
      request: updatedRequest,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, error: "Error updating payment method" });
  }
};
const getAllRequestController = async (req, res) => {
  try {
    // Fetch all requests
    const allRequests = await Request.find({});

    // Extracting all testIds from allRequests
    const allTestIds = allRequests.reduce(
      (testIds, request) => testIds.concat(request.testids),
      []
    );

    // Find tests corresponding to the extracted testIds
    const tests = await Test.find({ _id: { $in: allTestIds } });

    // Create a map to easily lookup test names by testId
    const testMap = new Map();
    tests.forEach((test) => {
      testMap.set(test._id.toString(), test.testName);
    });

    // Extract all unique userIds and collectorIds
    const userIds = allRequests.map((request) => request.userId);
    const collectorIds = allRequests.map((request) => request.collectorId);

    // Fetch user details for userIds and collectorIds
    const users = await User.find(
      { _id: { $in: [...userIds] } },
      { _id: 1, name: 1 } // Project only _id and name fields
    );

    const collectors = await Collector.find(
      { _id: { $in: [...collectorIds] } },
      { _id: 1, fullName: 1 } // Project only _id and name fields
    );

    // Create a map to easily lookup user names by userId
    const userMap = new Map();
    users.forEach((user) => {
      userMap.set(user._id.toString(), user.name);
    });
    const collectorMap = new Map();
    collectors.forEach((collector) => {
      collectorMap.set(collector._id.toString(), collector.fullName);
    });

    // Map test names, userId names, and collectorId names to each request
    const requestsWithDetails = allRequests.map((request) => ({
      ...request.toObject(),
      testNames: request.testids.map((testId) =>
        testMap.get(testId.toString())
      ),
      userName: userMap.get(request.userId.toString()),
      collectorName: collectorMap.get(request.collectorId.toString()),
    }));
    return res.status(200).json({ success: true, requestsWithDetails });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch all requests" });
  }
};
const getAllRequestWithStatus=async(req,res)=>{
  try {
    const pendingRequests = await Request.find({ status: "Pending" }); 
    const accepctedRequests = await Request.find({ status: "Accepted" }); 
    const rejectedRequests = await Request.find({ status: "Rejected" });
    return res.status(200).json({ success: true, pendingRequests:pendingRequests.length,accepctedRequests:accepctedRequests.length, rejectedRequests:rejectedRequests.length});
  } catch (error) {
    console.error(error);

    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch pending requests" });
  }
}
module.exports = {
  updateRequestStatusController,
  deleteRequestController,
  findPendingRequestController,
  findAccepctedRequestController,
  findRejectedRequestController,
  checkRequestStatusController,
  updatePaymentMethodController,
  getAllRequestController,
  getAllRequestWithStatus
};
