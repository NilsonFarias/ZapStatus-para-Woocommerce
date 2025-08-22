-- Migration to make instanceId nullable in message_queue table
-- This allows preserving sent messages for billing when instances are deleted

BEGIN;

-- Drop the existing foreign key constraint
ALTER TABLE message_queue DROP CONSTRAINT IF EXISTS message_queue_instance_id_whatsapp_instances_id_fk;

-- Make instanceId column nullable
ALTER TABLE message_queue ALTER COLUMN instance_id DROP NOT NULL;

-- Re-add the foreign key constraint with ON DELETE SET NULL
ALTER TABLE message_queue 
ADD CONSTRAINT message_queue_instance_id_whatsapp_instances_id_fk 
FOREIGN KEY (instance_id) REFERENCES whatsapp_instances(id) ON DELETE SET NULL;

COMMIT;