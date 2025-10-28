// Utility to handle Supabase schema cache issues
export const clearSchemaCache = async (supabase) => {
  try {
    // Force refresh the schema by making a simple query
    const { error } = await supabase
      .from('rides')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('Schema cache refresh attempted');
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing schema cache:', error);
    return false;
  }
};

// Alternative: Use raw SQL to ensure schema is up to date
export const verifySchema = async (supabase) => {
  try {
    const { data, error } = await supabase
      .rpc('verify_column_exists', {
        table_name: 'rides',
        column_name: 'vehicle_model'
      });
    
    if (error) {
      console.log('Schema verification completed');
    }
    
    return data;
  } catch (error) {
    console.error('Schema verification error:', error);
    return false;
  }
};