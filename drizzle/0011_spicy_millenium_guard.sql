CREATE TABLE `driver_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`companyName` varchar(100) NOT NULL,
	`amount` int NOT NULL,
	`paidAt` timestamp NOT NULL,
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `driver_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `drivers` ADD `bankName` varchar(50);--> statement-breakpoint
ALTER TABLE `drivers` ADD `accountNumber` varchar(30);--> statement-breakpoint
ALTER TABLE `drivers` ADD `accountHolder` varchar(50);