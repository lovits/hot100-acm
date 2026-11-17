#include <stdio.h>
#include <stdlib.h>




static struct TreeNode *partition(int *nums, int lo, int hi)
{
    if (lo > hi) {
        return NULL;
    }
    int mid = lo + (hi - lo) / 2;
    struct TreeNode *node = malloc(sizeof(*node));
    node->val = nums[mid];
    node->left = partition(nums, lo, mid - 1);
    node->right = partition(nums, mid + 1, hi);
    return node;
}

static struct TreeNode* sortedArrayToBST(int* nums, int numsSize)
{
    return partition(nums, 0, numsSize - 1);
}
