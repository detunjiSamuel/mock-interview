import Image from 'next/image'
import Link from 'next/link'

import { useAuth } from '../../AuthContext'

const AuthLinks = () => {
 const { isLoggedIn, logout } = useAuth();
 return isLoggedIn ? (

  <button onClick={() => logout()}>Logout</button>
 ) : (
  <div className='flex space-x-4'>
   <Link href="/auth/login" className='rounded text-center'>
    <div className='m-2'>
     Sign in
    </div >
   </Link >
   <Link href="/auth/register" className='rounded bg-black text-center text-white '>
    <div className='m-2'>
     Sign up
    </div>
   </Link>
  </div >
 )
}

export default function Navbar() {
 return (
  <nav className='flex justify-between h-18'>
   {/** logo */}
   <div>
    <Image
     src="/vercel.svg"
     width={100}
     height={100}
     alt="LOGO"
    />
   </div>
   {/** auth links */}
   <AuthLinks />

  </nav>
 )
}