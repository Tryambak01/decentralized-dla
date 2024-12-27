import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET, TOTAL_DECIMALS } from "../config";
import { S3Client } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { authMiddleware } from "../middleware";
import { createTaskInput } from "./types";

const prismaClient = new PrismaClient();

prismaClient.$transaction(
    async (prisma) => {
      // Code running in a transaction...
    },
    {
      maxWait: 5000, // default: 2000
      timeout: 10000, // default: 5000
    }
)

const accessKeyId = process.env.ACCESS_KEY_ID;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;
const region = process.env.REGION;

if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials are missing!');
}

const s3Client = new S3Client({
    credentials : {
        accessKeyId : accessKeyId,
        secretAccessKey : secretAccessKey,
    },
    region : region,
});

const router = Router();

const DEFAULT_TITLE = "Select the most clickable thumbnail!";

//@ts-ignore
router.get("/task", authMiddleware, async (req, res) => {
    //@ts-ignore
    const taskId : string = req.query.taskId;
    
    //@ts-ignore
    const userId : string = req.userId;

    //get task from task Id along with the options for that task
    const taskDetails = await prismaClient.task.findFirst({
        where : {
            user_id : Number(userId),
            id : Number(taskId),
        },

        include : {
            options : true
        }
    }); 
    
    if(!taskDetails) {
        res.status(411).json({
            message : "Task not found"
        });
    }

    //get submissions for that task and include option chosen in the submission
    const responses = await prismaClient.submission.findMany({
        where : {
            task_id : Number(taskId)
        },

        include : {
            option : true
        }
    });

    const result : Record<string, {
        count : number,
        option : {
            image_url : string,
        }
    }> = {};

    taskDetails?.options.forEach(option => {
        result[option.id] = {
            count : 0,
            option : {
                image_url : option.image_url
            }
        }
    });

    responses.forEach(r => {
        result[r.option_id].count++; 
    });

    res.json({
        result,
        taskDetails
    });

});

//@ts-ignore
router.post("/task", authMiddleware, async(req, res) => {
    console.log("Posting task into db")
    //@ts-ignore
    const userId = req.userId;
    const body = req.body;

    const parseData = createTaskInput.safeParse(body);

    if(!parseData.success){
        res.status(411).json({
            message : "Input is not in the correct format" 
        });
    }

    //parse the signature present inside req.body to ensure user has paid $50 and get the amount.

    //begin a transaction to update db with task and options
    console.log("Sending prisma request to update db");
    let response = await prismaClient.$transaction(async (tx) => {

        const response = await tx.task.create({
            data : {
                title : parseData.data?.title ?? DEFAULT_TITLE,
                amount : 1 * TOTAL_DECIMALS,
                signature : parseData.data?.signature ?? "",
                user_id : userId
            }
        });

        await tx.option.createMany({
            data : (parseData.data?.options ?? []).map((x) => ({
                image_url : x.image_url,
                task_id : response.id
            }))
        });
        console.log("return response from post/task");

        return response;
    });

    res.json({
        id : response.id
    })
});

//@ts-ignore
router.get("/presignedUrl", authMiddleware, async (req, res) => {
    //@ts-ignore
    const userId = req.userId;

    const { url, fields } = await createPresignedPost(s3Client, {
        Bucket: 'decentralized-dla',
        Key: `fiver-images/${userId}/${Math.random()}/image.png`,
        Conditions: [
          ['content-length-range', 0, 5 * 1024 * 1024] // 5 MB max
        ],
        Fields: {
          'Content-Type': 'image/png'
        },
        Expires: 3600
      })
      
    console.log({ url, fields })

    
    res.json({
        presignedUrl : url,
        fields
    });
});

router.post("/signin", async (req, res) => {
    //logic
    const hardcodedWalletAddress = "Hzejhdkqwdqhudiudhbb9028331";

    const existingUser = await prismaClient.user.findFirst({
        where : {
            address : hardcodedWalletAddress,
        }
    });

    if(existingUser){
        const token = jwt.sign({
            userId : existingUser.id
        }, JWT_SECRET);

        res.json({token});
    } else {
        const user = await prismaClient.user.create({
            data : {
                address : hardcodedWalletAddress
            }
        });
        const token = jwt.sign({
            userId : user.id
        }, JWT_SECRET);

        res.json({token});
    }
});

export default router;