bool isPalindrome(struct ListNode*h){int a[100000],n=0;for(;h;h=h->next)a[n++]=h->val;for(int i=0;i<n/2;i++)if(a[i]!=a[n-1-i])return false;return true;}
