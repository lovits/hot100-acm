#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/**
 * Definition for singly-linked list.
 * 
 */


static inline void swap(struct ListNode **a, struct ListNode **b)
{
    struct ListNode *t = *a;
    *a = *b;
    *b = t;
}

static void min_heapify(struct ListNode **nodes, int size, int parent)
{
    int i = parent;  /* parent is the root */
    int l = parent * 2 + 1;
    int r = parent * 2 + 2;

    if (l < size && nodes[l]->val < nodes[i]->val) {
        i = l;
    }

    if (r < size && nodes[r]->val < nodes[i]->val) {
        i = r;
    }

    /* percolate up */
    if (i != parent) {
        swap(&nodes[i], &nodes[parent]);
        min_heapify(nodes, size, i);
    }
}

static void build_min_heap(struct ListNode **nodes, int size)
{
    int i;

    if (size <= 0)  return;

    for (i = size / 2; i >= 0; i--) {
        min_heapify(nodes, size, i);
    }
}

static struct ListNode *get(struct ListNode **nodes, int size)
{
    struct ListNode *p = nodes[0];
    nodes[0] = nodes[--size];
    min_heapify(nodes, size, 0);
    return p;
}

static void put(struct ListNode **nodes, int size, struct ListNode *n)
{
    nodes[size++] = n;
    build_min_heap(nodes, size);
}

static struct ListNode* mergeTwoLists(struct ListNode* l1, struct ListNode* l2)
{
    struct ListNode dummy;
    struct ListNode *tail = &dummy;

    while (l1 != NULL && l2 != NULL) {
        if (l1->val <= l2->val) {
            tail->next = l1;
            l1 = l1->next;
        } else {
            tail->next = l2;
            l2 = l2->next;
        }
        tail = tail->next;
    }

    tail->next = l1 != NULL ? l1 : l2;

    return dummy.next;
}

static struct ListNode* dfs(struct ListNode** lists, int lo, int hi)
{
    if (lo > hi)  // listsSize might be zero
        return NULL; 

    if (lo == hi)
        return lists[lo];

    int mid = lo + (hi - lo) / 2;
    return mergeTwoLists(dfs(lists, lo, mid), dfs(lists, mid + 1, hi));
}


struct ListNode* mergeKLists(struct ListNode** lists, int listsSize)
{
#if 1
    return dfs(lists, 0, listsSize - 1);
#else
    int i, size = 0;
    struct ListNode dummy;
    struct ListNode *p = &dummy;
    struct ListNode **nodes = malloc(listsSize * sizeof(struct ListNode));

    for (i = 0; i < listsSize; i++) {
        if (lists[i] != NULL) {
            nodes[size++] = lists[i];
        }
    }

    build_min_heap(nodes, size);

    while (size > 0) {
        struct ListNode *n = get(nodes, size);
        size--;
        p->next = n;
        p = p->next;
        if (n->next != NULL) {
            put(nodes, size, n->next);
            size++;
        }
        n->next = NULL;
    }

    return dummy.next;
#endif
}
