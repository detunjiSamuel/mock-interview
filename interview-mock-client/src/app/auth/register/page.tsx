"use client"
import Err from '@/components/err/err';
import Link from 'next/link'

import { redirect, useRouter } from 'next/navigation'


import { useState, useEffect } from 'react';


const MAIN_API_URL = 'http://localhost:8080'


export default function Home() {

 const router = useRouter()


 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [err, setErr] = useState({
  msg: undefined,
  err: undefined
 });


 const register = async () => {

  const res = await fetch(MAIN_API_URL + '/api/auth/register', {
   cache: 'no-store',
   method: 'POST',
   headers: {
    "Content-Type": "application/json",
   },
   body: JSON.stringify({
    email,
    password
   })
  }
  )

  const data = await res.json()

  console.log(data)

  if (!res.ok) {
   setErr({
    msg: data.msg,
    err: data.err
   })
   return undefined
  }

  return data
 }



 const handleSubmit = async (e) => {
  e.preventDefault();

  const userDetails = await register()

  if (!userDetails) {
   setTimeout(() => {
    setErr({
     msg: undefined,
     err: undefined
    });
   }, 1000);

   return
  }
  
   localStorage.setItem('token', userDetails.token)
   localStorage.setItem('email', userDetails.email)

   router.push('/')

 };

 useEffect(() => {
  const token = localStorage.getItem('token');
  if (token) {
   redirect('/');
  }
 }, []);


 return (
  <main className='flex min-h-screen justify-center items-center'>

   <div className=" m-4">
    <form
     onSubmit={handleSubmit}
    >
     <div className="">
      <h2 className="text-center font-mono text-2xl font-bold text-gray-800 mb-6">
       Create your account
      </h2>


      <div className="font-mono text-xl font-bold text-gray-800 mb-6 text-center">
       Already have an account ? <Link href="/auth/login" className='underline hover:no-underline'>Sign in</Link>
      </div>




      {
       err.msg && <Err msg={err.msg} err={err.err} />
      }

     </div>

     <div className="mb-4">
      <label
       htmlFor="email"
       className="block text-gray-800 font-semibold mb-1"
      >
       Email
      </label>
      <input
       type="email"
       id="email"
       className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:border-indigo-500"
       placeholder="Enter your email"
       value={email}
       onChange={(e) => setEmail(e.target.value)}
      />
     </div>
     <div className="mb-6">
      <label
       htmlFor="password"
       className="block text-gray-800 font-semibold mb-1"
      >
       Password
      </label>
      <input
       type="password"
       id="password"
       className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:border-indigo-500"
       placeholder="Enter your password"
       value={password}
       onChange={(e) => setPassword(e.target.value)}
      />
     </div>

     <div className='flex justify-center items-center'>
      <button
       type="submit"
       className="bg-black hover:bg-red-300 text-white font-semibold py-2 px-4 rounded-md items-center w-full"
      >
       Sign Up
      </button>
     </div>

    </form>
   </div>

  </main>
 );
}
