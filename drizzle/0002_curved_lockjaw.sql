CREATE TABLE `work_log_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workLogId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(1024) NOT NULL,
	`originalName` varchar(255),
	`mimeType` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `work_log_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `work_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dispatchOrderId` int NOT NULL,
	`driverId` int NOT NULL,
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `work_logs_id` PRIMARY KEY(`id`)
);
