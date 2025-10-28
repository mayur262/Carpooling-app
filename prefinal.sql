-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL,
  passenger_id uuid NOT NULL,
  seats_booked integer NOT NULL CHECK (seats_booked > 0),
  total_price numeric NOT NULL,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'completed'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  is_rated boolean DEFAULT false,
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES public.rides(id),
  CONSTRAINT bookings_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.users(id)
);
CREATE TABLE public.live_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL,
  user_id uuid NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT live_locations_pkey PRIMARY KEY (id),
  CONSTRAINT live_locations_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES public.rides(id),
  CONSTRAINT live_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['booking'::text, 'message'::text, 'rating'::text, 'ride_update'::text])),
  is_read boolean DEFAULT false,
  related_id uuid,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  rater_id uuid NOT NULL,
  ratee_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  rating_type text NOT NULL CHECK (rating_type = ANY (ARRAY['driver'::text, 'passenger'::text])),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT ratings_pkey PRIMARY KEY (id),
  CONSTRAINT ratings_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES public.rides(id),
  CONSTRAINT ratings_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT ratings_rater_id_fkey FOREIGN KEY (rater_id) REFERENCES public.users(id),
  CONSTRAINT ratings_ratee_id_fkey FOREIGN KEY (ratee_id) REFERENCES public.users(id)
);
CREATE TABLE public.ride_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  passenger_id uuid NOT NULL,
  origin text NOT NULL,
  origin_coordinates point,
  destination text NOT NULL,
  destination_coordinates point,
  requested_date date NOT NULL,
  requested_time time without time zone,
  flexible_time boolean DEFAULT false,
  number_of_passengers integer NOT NULL CHECK (number_of_passengers > 0),
  max_price_per_person numeric CHECK (max_price_per_person >= 0::numeric),
  description text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text])),
  accepted_by_driver uuid,
  accepted_ride_id uuid,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT ride_requests_pkey PRIMARY KEY (id),
  CONSTRAINT ride_requests_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.users(id),
  CONSTRAINT ride_requests_accepted_by_driver_fkey FOREIGN KEY (accepted_by_driver) REFERENCES public.users(id),
  CONSTRAINT ride_requests_accepted_ride_id_fkey FOREIGN KEY (accepted_ride_id) REFERENCES public.rides(id)
);
CREATE TABLE public.rides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  ride_date date NOT NULL,
  ride_time time without time zone NOT NULL,
  available_seats integer NOT NULL CHECK (available_seats > 0),
  price_per_seat numeric NOT NULL CHECK (price_per_seat >= 0::numeric),
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT rides_pkey PRIMARY KEY (id),
  CONSTRAINT rides_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  profile_pic text,
  bio text,
  role text DEFAULT 'user'::text CHECK (role = ANY (ARRAY['user'::text, 'driver'::text, 'both'::text])),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  average_rating numeric DEFAULT 0.00,
  total_ratings integer DEFAULT 0,
  full_name text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);