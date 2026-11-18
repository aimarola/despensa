export interface Household {
  id: string
  name: string
  invite_code: string
}

export interface Member {
  household_id: string
  user_id: string
  display_name: string
}

export interface Supermarket {
  id: string
  household_id: string
  name: string
  color: string
}

export interface Product {
  id: string
  household_id: string
  name: string
  brand: string | null
  barcode: string | null
  image_url: string | null
  created_at: string
  product_supermarkets?: { supermarket_id: string }[]
}

export interface ListItem {
  id: string
  household_id: string
  product_id: string
  quantity: number
  note: string | null
  status: 'pending' | 'bought' | 'removed'
  added_by: string | null
  added_at: string
}

export interface ProductStats {
  product_id: string
  times_bought: number
  total_quantity: number
  first_bought: string
  last_bought: string
  avg_days_between: number | null
}

export interface Trip {
  id: string
  household_id: string
  supermarket_id: string | null
  done_by: string | null
  done_at: string
  item_count: number
}

export interface Purchase {
  id: string
  trip_id: string
  product_id: string
  quantity: number
  purchased_at: string
}
