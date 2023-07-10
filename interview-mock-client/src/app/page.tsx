"use client"
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react';

const MAIN_API_URL = 'http://localhost:8080'


// const questions = [
//  {
//   status: true,
//   topic: "Time you disagreed with a supervisor or superior",
//   difficulty: "medium",
//   category: "Behavioural"
//  },
//  {
//   status: false,
//   topic: "Time you disagreed with a supervisor or superior",
//   difficulty: "medium",
//   category: "Behavioural"
//  },
//  {
//   status: false,
//   topic: "Time you disagreed with a supervisor or superior",
//   difficulty: "medium",
//   category: "Behavioural"
//  },
//  {
//   status: true,
//   topic: "Time you disagreed with a supervisor or superior",
//   difficulty: "medium",
//   category: "Behavioural"
//  }
// ]


const getQuestions = async () => {
 const auth_header = 'Bearer ' + (localStorage.getItem('token') || 'wrong')

 const res = await fetch(MAIN_API_URL + '/api/questions', {
  cache: 'no-store',
  headers: {
   "Content-Type": "application/json",
   "Authorization": auth_header,
  }
 })
 const data = await res.json()
 console.log(data)
 return data.questions
}

export default function Home() {
 const [questions, setQuestions] = useState([]);
 const [isLoading, setIsLoading] = useState(true);

 useEffect(() => {
   const fetchQuestions = async () => {
     setIsLoading(true);
     const data = await getQuestions();
     setQuestions(data);
     setIsLoading(false);
   };

   fetchQuestions();
 }, []);

 return (
   <main className="flex min-h-screen flex-col min-h-screen">
     <div className="pb-12"></div>

     <section>
       <h2 className="font-mono font-bold">
         Perfect your interview performance.
         <span className="font-mono font-bold"></span>
       </h2>
       <p className="text-gray-800">
         Select a question or topic to practice. Our AI will ask you questions and give you feedback instantly to help you
         ace your next interview.
       </p>
     </section>

     <div className="pb-12"></div>

     {/** questions and companies section */}

     <section className="flex flex-row">
       <div className="basis-3/4 bg-gray-50 mr-4 card">
         {/* Questions Section */}
         {isLoading ? (
           <div className="w-full h-full bg-gray-200 flex items-center justify-center">
             <span>Loading...</span>
           </div>
         ) : (
           <table className="table-auto w-full">
             <thead className="text-xs font-semibold uppercase">
               <tr>
                 <th className="p-2 whitespace-nowrap text-left font-semibold">STATUS</th>
                 <th className="p-2 whitespace-nowrap text-left font-semibold">TOPIC</th>
                 <th className="p-2 whitespace-nowrap text-left font-semibold">DIFFICULTY</th>
                 <th className="p-2 whitespace-nowrap text-left font-semibold">CATEGORY</th>
               </tr>
             </thead>
             <tbody>
               {questions.map((question, index) => (
                 <tr key={index} className="odd:bg-gray-100 m-2">
                   <td>
                     <div className="flex items-center justify-center">
                       {question.status ? (
                         <div className="w-4 h-4 bg-green-500 rounded-full" />
                       ) : (
                         <div className="w-4 h-4 bg-red-500 rounded-full" />
                       )}
                     </div>
                   </td>
                   <td className="text-gray-800 p-2 whitespace-nowrap text-left normal-case hover:underline">
                     <Link href={'/questions/' + question.topic.split(' ').join('-')}>
                       {question.topic}
                     </Link>
                   </td>
                   <td className="text-gray-800 p-2 whitespace-nowrap text-left capitalize">
                     {question.difficulty}
                   </td>
                   <td className="text-gray-800 p-2 whitespace-nowrap text-left capitalize">
                     {question.category}
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         )}
       </div>
       <div className="basis-1/4 bg-red-100 card">Companies Section</div>
     </section>
   </main>
 );
}