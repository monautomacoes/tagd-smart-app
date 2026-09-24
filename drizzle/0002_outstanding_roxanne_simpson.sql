ALTER TABLE `tags` ADD `programmingStatus` enum('not_programmed','programmed','protected') DEFAULT 'not_programmed' NOT NULL;--> statement-breakpoint
ALTER TABLE `tags` ADD `nfcModel` varchar(60);--> statement-breakpoint
ALTER TABLE `tags` ADD `protectionNote` text;--> statement-breakpoint
ALTER TABLE `tags` ADD `programmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `tags` ADD `protectedAt` timestamp;