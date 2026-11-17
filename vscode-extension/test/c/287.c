int findDuplicate(int*a,int n){int slow=a[0],fast=a[a[0]];while(slow!=fast){slow=a[slow];fast=a[a[fast]];}slow=0;while(slow!=fast){slow=a[slow];fast=a[fast];}return slow;}
