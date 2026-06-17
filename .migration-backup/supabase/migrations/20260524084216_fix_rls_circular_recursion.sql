/*
  # Fix RLS Circular Recursion

  ## Problem
  The SELECT policies on `tenants` and `team_members` created a circular dependency:
  - tenants policy references team_members
  - team_members policy references tenants
  This caused "infinite recursion detected in policy for relation tenants" errors.

  ## Solution
  Break the circular reference by simplifying the policies:
  
  1. `tenants` SELECT: User can view if they are owner OR if they have a team_members row
  2. `team_members` SELECT: Simplified to check user_id directly (no tenant lookup needed)
  3. `team_members` INSERT/UPDATE: Use owner_user_id from auth.uid() directly

  ## Changes
  - DROP existing circular policies on both tables
  - CREATE new simplified policies that don't reference each other
*/

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view own tenants" ON tenants;
DROP POLICY IF EXISTS "Users can insert own tenants" ON tenants;
DROP POLICY IF EXISTS "Users can update own tenants" ON tenants;
DROP POLICY IF EXISTS "Tenant members can view team" ON team_members;
DROP POLICY IF EXISTS "Tenant admins can manage team" ON team_members;
DROP POLICY IF EXISTS "Tenant admins can update team" ON team_members;

-- Create new non-circular policies for tenants
CREATE POLICY "Users can view own tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
      AND team_members.tenant_id = tenants.id
    )
  );

CREATE POLICY "Users can insert own tenants"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can update own tenants"
  ON tenants FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Create new non-circular policies for team_members
CREATE POLICY "Users can view team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Tenant owners can add team members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = team_members.tenant_id
      AND tenants.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant owners and admins can update team members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = team_members.tenant_id
      AND tenants.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.tenant_id = team_members.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Tenant owners can delete team members"
  ON team_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = team_members.tenant_id
      AND tenants.owner_user_id = auth.uid()
    )
  );