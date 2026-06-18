CREATE TABLE `driver_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`isRead` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `driver_notifications_id` PRIMARY KEY(`id`)
);
