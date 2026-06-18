CREATE TABLE `dispatch_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`pickupLocation` text NOT NULL,
	`dropoffLocation` text NOT NULL,
	`approvalStatus` enum('pending','confirmed') NOT NULL DEFAULT 'pending',
	`dispatchType` enum('forced','normal') NOT NULL DEFAULT 'forced',
	`memo` text,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dispatch_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`vehicleNumber` varchar(20),
	`vehicleType` varchar(50),
	`affiliation` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drivers_id` PRIMARY KEY(`id`)
);
