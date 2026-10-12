CREATE TABLE `portfolio` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer NOT NULL,
	`owner_user_id` text NOT NULL,
	`updated_at` text NOT NULL
);
