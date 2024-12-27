import z from "zod";

export const createTaskInput = z.object({
    options : z.array(z.object({
        image_url : z.string()
    })).min(2),
    title : z.string().optional(),
    signature : z.string(),
});

export const createSubmissionInput = z.object({
    task_id : z.string(),
    option_id : z.string(),
});