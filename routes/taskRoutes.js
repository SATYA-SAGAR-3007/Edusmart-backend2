const express=require("express")
const router=express.Router()
const { verifyToken } = require("../middleware/authMiddleware")

const taskController=require("../controllers/taskController")

router.post("/",verifyToken,taskController.addTask)
router.get("/",verifyToken, taskController.getTasks)
router.get("/student/:id",verifyToken,taskController.getStudentTasks)

module.exports=router