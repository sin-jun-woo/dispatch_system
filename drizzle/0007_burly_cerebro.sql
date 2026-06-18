CREATE TABLE `sms_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(100) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sms_templates_id` PRIMARY KEY(`id`)
);
