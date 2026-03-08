export interface LeadershipMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  imageUrl: string;
  linkedIn?: string;
  email?: string;
}

export const leadershipData: LeadershipMember[] = [
  {
    id: "1",
    name: "Nishant Raj",
    role: "Founder & CEO",
    bio: "Visionary leader with 20+ years in enterprise cloud solutions, driving SISWIT's mission to transform businesses.",
    imageUrl: "./public/nishant.jpeg",
    linkedIn: "https://linkedin.com/in/",
    email: "leadership@siswit.com"
  },
  {
    id: "2",
    name: "Anand Mishra",
    role: "Co-Founder & COO",
    bio: "Operations expert ensuring seamless delivery and customer success across all SISWIT solutions.",
    imageUrl: "./public/anand.jpeg",
    linkedIn: "https://www.linkedin.com/in/anand-ranjan-812b2b260/",
    email: "operations@siswit.com"
  },
  {
    id: "3",
    name: "Hariom Singh",
    role: "Chief Technology Officer",
    bio: "Tech innovator architecting cutting-edge cloud infrastructure and AI-powered enterprise solutions.",
    imageUrl: "./public/hariom.jpeg",
    linkedIn: "https://linkedin.com/in/",
    email: "leadership@siswit.com"
  },
  {
    id: "4",
    name: "Sneha Reddy",
    role: "Chief Product Officer",
    bio: "Product strategist crafting intuitive CPQ, CLM & CRM solutions that enterprises love.",
    imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face",
    linkedIn: "https://linkedin.com/in/"
  },
  {
    id: "5",
    name: "Vikram Singh",
    role: "VP of Engineering",
    bio: "Engineering leader building scalable, secure cloud platforms trusted by Fortune 500 companies.",
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
    linkedIn: "https://linkedin.com/in/"
  },
  {
    id: "6",
    name: "Ananya Gupta",
    role: "Chief Marketing Officer",
    bio: "Brand strategist driving SISWIT's global presence and customer engagement initiatives.",
    imageUrl: "https://images.unsplash.com/photo-1598550874175-4d0ef436c909?w=400&h=400&fit=crop&crop=face",
    linkedIn: "https://linkedin.com/in/",
    email: "marketing@siswit.com"
  }
];
