alter table users add column if not exists password_hash text;
create unique index if not exists users_email_key on users(email);
