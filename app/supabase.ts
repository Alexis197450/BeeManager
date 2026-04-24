import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fajobxmmxopczhymiblw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZham9ieG1teG9wY3poeW1pYmx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTM1ODYsImV4cCI6MjA5MTkyOTU4Nn0.4kRhKOuPyWAz3kxuuPaeqPg02tq777bJnJVbLhoqcWI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)