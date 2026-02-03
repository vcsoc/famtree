// Demo family tree data with 10 fake family members
export const DEMO_PEOPLE = [
  {
    id: "demo-1",
    first_name: "John",
    last_name: "Smith",
    gender: "male",
    birth_date: "1950-05-15",
    death_date: "",
    position_x: 400,
    position_y: 100
  },
  {
    id: "demo-2",
    first_name: "Mary",
    last_name: "Johnson",
    gender: "female",
    birth_date: "1952-08-22",
    death_date: "",
    position_x: 600,
    position_y: 100
  },
  {
    id: "demo-3",
    first_name: "Robert",
    last_name: "Smith",
    gender: "male",
    birth_date: "1975-03-10",
    death_date: "",
    position_x: 300,
    position_y: 300
  },
  {
    id: "demo-4",
    first_name: "Jennifer",
    last_name: "Williams",
    gender: "female",
    birth_date: "1977-11-05",
    death_date: "",
    position_x: 500,
    position_y: 300
  },
  {
    id: "demo-5",
    first_name: "Michael",
    last_name: "Smith",
    gender: "male",
    birth_date: "1978-06-18",
    death_date: "",
    position_x: 700,
    position_y: 300
  },
  {
    id: "demo-6",
    first_name: "Sarah",
    last_name: "Brown",
    gender: "female",
    birth_date: "1980-01-25",
    death_date: "",
    position_x: 900,
    position_y: 300
  },
  {
    id: "demo-7",
    first_name: "David",
    last_name: "Smith",
    gender: "male",
    birth_date: "2000-09-12",
    death_date: "",
    position_x: 400,
    position_y: 500
  },
  {
    id: "demo-8",
    first_name: "Emily",
    last_name: "Smith",
    gender: "female",
    birth_date: "2002-04-30",
    death_date: "",
    position_x: 600,
    position_y: 500
  },
  {
    id: "demo-9",
    first_name: "James",
    last_name: "Smith",
    gender: "male",
    birth_date: "2003-12-08",
    death_date: "",
    position_x: 800,
    position_y: 500
  },
  {
    id: "demo-10",
    first_name: "Olivia",
    last_name: "Smith",
    gender: "female",
    birth_date: "2005-07-14",
    death_date: "",
    position_x: 1000,
    position_y: 500
  }
];

export const DEMO_RELATIONSHIPS = [
  // John & Mary are spouses
  {
    id: "demo-rel-1",
    person1_id: "demo-1",
    person2_id: "demo-2",
    type: "spouse"
  },
  // Robert is child of John & Mary
  {
    id: "demo-rel-2",
    person1_id: "demo-1",
    person2_id: "demo-3",
    type: "parent-child"
  },
  {
    id: "demo-rel-3",
    person1_id: "demo-2",
    person2_id: "demo-3",
    type: "parent-child"
  },
  // Michael is child of John & Mary
  {
    id: "demo-rel-4",
    person1_id: "demo-1",
    person2_id: "demo-5",
    type: "parent-child"
  },
  {
    id: "demo-rel-5",
    person1_id: "demo-2",
    person2_id: "demo-5",
    type: "parent-child"
  },
  // Robert & Jennifer are spouses
  {
    id: "demo-rel-6",
    person1_id: "demo-3",
    person2_id: "demo-4",
    type: "spouse"
  },
  // Michael & Sarah are spouses
  {
    id: "demo-rel-7",
    person1_id: "demo-5",
    person2_id: "demo-6",
    type: "spouse"
  },
  // David & Emily are children of Robert & Jennifer
  {
    id: "demo-rel-8",
    person1_id: "demo-3",
    person2_id: "demo-7",
    type: "parent-child"
  },
  {
    id: "demo-rel-9",
    person1_id: "demo-4",
    person2_id: "demo-7",
    type: "parent-child"
  },
  {
    id: "demo-rel-10",
    person1_id: "demo-3",
    person2_id: "demo-8",
    type: "parent-child"
  },
  {
    id: "demo-rel-11",
    person1_id: "demo-4",
    person2_id: "demo-8",
    type: "parent-child"
  },
  // James & Olivia are children of Michael & Sarah
  {
    id: "demo-rel-12",
    person1_id: "demo-5",
    person2_id: "demo-9",
    type: "parent-child"
  },
  {
    id: "demo-rel-13",
    person1_id: "demo-6",
    person2_id: "demo-9",
    type: "parent-child"
  },
  {
    id: "demo-rel-14",
    person1_id: "demo-5",
    person2_id: "demo-10",
    type: "parent-child"
  },
  {
    id: "demo-rel-15",
    person1_id: "demo-6",
    person2_id: "demo-10",
    type: "parent-child"
  },
  // Robert & Michael are siblings
  {
    id: "demo-rel-16",
    person1_id: "demo-3",
    person2_id: "demo-5",
    type: "sibling"
  }
];
