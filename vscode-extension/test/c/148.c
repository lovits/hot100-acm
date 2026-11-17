#include <stdio.h>
#include <stdlib.h>



static void traverse(struct ListNode *dummy, struct ListNode *end)
{
    if (dummy == NULL || dummy->next == end) {
        return;
    }

    struct ListNode *pivot = dummy->next;
    struct ListNode *prev = pivot;
    struct ListNode *p = pivot->next;
    struct ListNode *first = NULL;

    while (p != end) {
        if (p->val >= pivot->val) {
            if (first == NULL && p->val > pivot->val) {
                first = prev;
            }
            prev = p;
            p = p->next;
        } else {
            prev->next = p->next;
            p->next = dummy->next;
            dummy->next = p;
            p = prev->next;
        }
    }

    traverse(dummy, pivot);
    traverse(first, end);
}

static struct ListNode *sortList(struct ListNode *head)
{
    struct ListNode dummy;
    dummy.next = head;
    traverse(&dummy, NULL);
    return dummy.next;
}
