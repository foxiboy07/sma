/*
  # Add TEXT and QA to kb_source_type enum
*/
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kb_source_type') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'kb_source_type' AND e.enumlabel = 'TEXT') THEN
      ALTER TYPE kb_source_type ADD VALUE 'TEXT';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'kb_source_type' AND e.enumlabel = 'QA') THEN
      ALTER TYPE kb_source_type ADD VALUE 'QA';
    END IF;
  END IF;
END $$;