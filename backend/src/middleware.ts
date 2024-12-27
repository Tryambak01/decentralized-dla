
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./config";
import { WORKER_JWT_SECRET } from "./config";
import { NextFunction, Request, Response } from "express";

export function authMiddleware (req : Request, res : Response, next : NextFunction) {
    const authHeader = req.headers["authorization"] ?? "";

    try {
        const decoded = jwt.verify(authHeader, JWT_SECRET);
        
        //@ts-ignore
        if(!decoded.userId){
            return res.status(403).json({
                message : "You are not logged in",
            });
        }
        
        //@ts-ignore
        req.userId = decoded.userId; 
        next();
    } catch (err) {
        return res.status(403).json({
            message : "You are not logged in",
        });
    }
};

export function workerAuthMiddleware (req : Request, res : Response, next : NextFunction) {
    const authHeader = req.headers["authorization"] ?? "";
    
    try {
        const decoded = jwt.verify(authHeader, WORKER_JWT_SECRET);
        //@ts-ignore
        if(!decoded.userId){
            return res.status(403).json({
                message : "You are not logged in",
            });
        }
        
        //@ts-ignore
        req.userId = decoded.userId; 
        next();
    } catch (err) {
        return res.status(403).json({
            message : "You are not logged in error",
        });
    }
};