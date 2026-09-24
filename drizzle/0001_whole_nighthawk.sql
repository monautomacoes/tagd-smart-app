CREATE TABLE `businesses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`segment` varchar(100),
	`city` varchar(120),
	`contactName` varchar(140),
	`phone` varchar(40),
	`email` varchar(320),
	`notes` text,
	`stage` enum('lead','contacted','demo','proposal','won','lost') NOT NULL DEFAULT 'lead',
	`consentStatus` enum('unknown','allowed','blocked') NOT NULL DEFAULT 'unknown',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businesses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(180) NOT NULL,
	`segment` varchar(100),
	`description` text NOT NULL,
	`cta` varchar(140) NOT NULL DEFAULT 'Quero uma demonstração',
	`validUntil` timestamp,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outreachMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`offerId` int,
	`channel` enum('whatsapp','email','instagram','manual') NOT NULL DEFAULT 'manual',
	`subject` varchar(180),
	`body` text NOT NULL,
	`status` enum('draft','queued','sent','replied','opted_out') NOT NULL DEFAULT 'draft',
	`scheduledFor` timestamp,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `outreachMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessId` int NOT NULL,
	`code` varchar(32) NOT NULL,
	`label` varchar(140) NOT NULL,
	`material` varchar(80),
	`placement` varchar(100),
	`destinationType` enum('google','whatsapp','instagram','tiktok','multilink','custom') NOT NULL DEFAULT 'multilink',
	`destinationUrl` text NOT NULL,
	`whatsappMessage` text,
	`status` enum('active','paused','draft') NOT NULL DEFAULT 'active',
	`scans` int NOT NULL DEFAULT 0,
	`lastScannedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_code_unique` UNIQUE(`code`)
);
