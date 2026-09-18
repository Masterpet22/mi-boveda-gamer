CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`platform` text NOT NULL,
	`format` text DEFAULT 'Digital' NOT NULL,
	`status` text DEFAULT 'Backlog' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`hours` integer DEFAULT 0 NOT NULL,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`series` text DEFAULT '' NOT NULL,
	`next_goal` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
