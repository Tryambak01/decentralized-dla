import { PrismaClient } from "@prisma/client";

const prismaClient = new PrismaClient;

export async function getNextTask(userId : number) {
    const task = await prismaClient.task.findFirst({
        where : {
            submissions : {
                none : {
                    worker_id : userId
                },
            },
            done : false
        },
        select : {
            id : true,
            title : true,
            options : true,
            amount : true,
        }
    });

    return task;
};